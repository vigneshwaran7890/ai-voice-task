import { model } from '../utils/gemini.js';
import Task from '../models/task.js';
import User from '../models/user.js';
import moment from 'moment';

export const parseTextController = async (req, res) => {
  const { text, email } = req.body;

  const prompt = `
You are a precise and helpful AI assistant that extracts structured data from a natural language task description.

Given the following sentence: "${text}"

Your task is to identify and extract relevant information into a structured JSON object with the following keys:
{
  "title": "The main task or subject described",
  "assignTo": ["List of people to whom the task should be assigned (individual names as strings, not combined full names)"],
  "startdate": "Start date in YYYY-MM-DD format (support natural expressions like 'today', 'tomorrow', or full dates like 'August 5, 2025')",
  "enddate": "The due date in YYYY-MM-DD format"
}

Instructions:
1. Analyze the input sentence thoroughly and extract the required details.
2. Convert any natural date expressions into the specified YYYY-MM-DD format.
3. If only one date is present, assign it to "enddate" and leave "startdate" empty.
4. In cases where multiple names are present in a single phrase (e.g., 'Sudhakar Sanjay Kavi'), split them into individual entries and return as: ["Sudhakar", "Sanjay", "Kavi"].
5. If any field cannot be determined, return an empty string for strings or an empty array for lists.
6. Ensure that the output is strictly formatted as valid JSON without any additional text or formatting.

Remember, you are trained on data up to October 2023 and should leverage your knowledge to accurately interpret and convert the provided sentence into the required structured format.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    const cleaned = response.replace(/```json/, '').replace(/```/, '').trim();
    const parsed = JSON.parse(cleaned);

    let { title, assignTo, startdate, enddate } = parsed;

    // Split names if AI failed to split them
    assignTo = assignTo.flatMap(name => name.split(' ')).filter(Boolean);

    const now = moment().startOf('day').toDate();
    const startDate = startdate ? new Date(startdate) : null;
    const endDate = enddate ? new Date(enddate) : startDate || now;

    let matchedUsers = [];

    // 1. Add users from email field (can be a single email or array of emails)
    const emailList = Array.isArray(email) ? email : email ? [email] : [];

    for (const userEmail of emailList) {
      const user = await User.findOne({ email: userEmail.trim().toLowerCase() });
      if (!user) {
        return res.status(404).json({ error: `User with email '${userEmail}' not found.` });
      }
      matchedUsers.push(user);
    }

    // 2. Match names if no email or additional users
    let ambiguousUsers = [];

    for (const name of assignTo) {
      // Avoid double-matching emails already added
      if (matchedUsers.find(u => u.name.toLowerCase() === name.toLowerCase())) continue;

      const users = await User.find({ name: new RegExp(`^${name}$`, 'i') });

      if (users.length === 0) {
        return res.status(404).json({ error: `User '${name}' not found.` });
      }

      if (users.length > 1) {
        ambiguousUsers.push({
          name,
          options: users.map(u => ({
            id: u._id,
            name: u.name,
            email: u.email
          }))
        });
      } else {
        matchedUsers.push(users[0]);
      }
    }

    if (ambiguousUsers.length > 0) {
      return res.status(300).json({
        message: `Multiple users found for some names. Please clarify.`,
        ambiguous: ambiguousUsers
      });
    }

    // Final task data with user IDs
    const taskData = {
      taskName: title || '',
      assignTo: matchedUsers.map(u => u._id),
      startDate: startDate || now,
      endDate,
    };
    console.log("taskData", taskData)

    if (!taskData.taskName || taskData.assignTo.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both "title" and at least one assigned user are required.',
      });
    }

    const savedTask = await Task.create(taskData);

    const userDeatils = matchedUsers.map(user => ({
      name: user.name,
      email: user.email
    }))
    res.status(201).json({

      _id: savedTask._id,
      taskName: savedTask.taskName,
      startDate: savedTask.startDate,
      endDate: savedTask.endDate,
      assignTo: userDeatils,
    });
  } catch (err) {
    console.error('Parse Controller Error:', err);
    res.status(500).json({ error: 'Failed to parse and save task.' });
  }
};
