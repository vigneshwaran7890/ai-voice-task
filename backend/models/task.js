import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
    {
        taskName: {
            type: String,
            required: true,
            trim: true,
        },
        assignTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            default: Date.now
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const Task = mongoose.model('task', taskSchema);
export default Task;
