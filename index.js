const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB connection using the URI from the .env file
const uri = process.env.MONGO_URI;
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// Define the message schema with userId field
const messageSchema = new mongoose.Schema({
    text: String,
    userId: String,  // Store the user ID who sent the message
    createdAt: { type: Date, default: Date.now }
});

// Create the Message model
const Message = mongoose.model('Message', messageSchema);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', async (socket) => {
    console.log('A user connected');

    try {
        // Send the last 100 messages to the newly connected user
        const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
        // Send the messages in reverse order (oldest to newest)
        socket.emit('init', messages.reverse());
    } catch (err) {
        console.error('Error fetching messages:', err);
    }

    // Handle the "chat message" event
    socket.on('chat message', async (msg) => {
        try {
            // Save the message to the database
            const message = new Message({
                text: msg.text,
                userId: msg.userId  // Store the userId sent by the client
            });

            await message.save();

            // Emit the message to everyone (including the sender)
            io.emit('chat message', msg);

            // Remove old messages if more than 100 exist
            const messageCount = await Message.countDocuments();
            if (messageCount > 25) {
                // Remove the oldest message
                const oldestMessage = await Message.findOne().sort({ createdAt: 1 });
                if (oldestMessage) {
                    await oldestMessage.remove();
                }
            }
        } catch (err) {
            console.error('Error saving or managing messages:', err);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
