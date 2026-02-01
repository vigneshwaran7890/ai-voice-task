import User from '../models/user.js';

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: 'User already exists' });

    const user = new User({ name, email, password });
    await user.save();

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }

  // hello
};

// @desc    Get all users
// @route   GET /api/users
// @access  Public (for example purposes)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // omit password
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
