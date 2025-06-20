import express, { Request, Response } from 'express';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import Customer from './models/Customer'; // Adjust the path accordingly
import bcrypt from 'bcrypt';
import { connect } from 'mongoose';
import * as dotenv from 'dotenv';
import { authenticateToken } from './middleware/authentication';

// Load environment variables from .env file
dotenv.config();

connect(process.env.MONGODB_URI!).then(() => {
    console.log(`MongoDB connected`);
}).catch((err: Error) => {
    console.log(err);
});

// Define the structure of the JWT payload
interface JwtPayload {
    id: string;
}

const app = express();
const port = process.env.PORT || 3000;
const storage = new Storage({ keyFilename: process.env.GOOGLE_CLOUD_KEYFILE_PATH });
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME!);
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Rate limiting middleware
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 upload requests per windowMs
    message: 'Too many upload requests from this IP, please try again after an hour'
});

const fetchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // Limit each IP to 100 fetch requests per windowMs
    message: 'Too many fetch requests from this IP, please try again after an hour'
});

app.post('/api/create-customer', async (req: Request, res: Response) => {
    try {
        // Create Customer in MongoDB with Stripe customer ID and subscription ID
        const customer = new Customer({
            name: req.body.name,
            email: req.body.email,
            address: req.body.address,
            phone: req.body.phone,
            password: req.body.password,
        });

        await customer.save();

        res.status(201).json({
            customer,
        });

    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
})
// Route to handle sign in for authentication
app.post('/api/sign-in', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const customer = await Customer.findOne({ email });
        if (!customer) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        const token = customer.generateAuthToken();
        res.json({ token });
    } catch (error) {
        console.error('Error handling sign in:', error);
        res.status(500).send('Error handling sign in.');
    }
});

// Route to handle image upload
app.post('/api/upload-profile-picture', authenticateToken, uploadLimiter, upload.single('profilePicture'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).send('No file uploaded.');
            return;
        }

        const customer = req.customer;
        if (!customer) {
            res.status(401).send(`No customer found`);
            return;
        }

        const blob = bucket.file(`profile_pictures/${customer.id}_${Date.now()}`);
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype
            },
        });

        blobStream.on('error', (err) => {
            console.error('Error uploading to Google Cloud Storage:', err);
            res.status(500).send('Error uploading image.');
        });

        blobStream.on('finish', async () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

            // Update the customer's profile picture URL in the database
            await Customer.findByIdAndUpdate(customer.id, { profilePictureUrl: publicUrl });

            res.status(200).send({ message: 'Profile picture uploaded successfully.', url: publicUrl });
        });

        blobStream.end(req.file.buffer);
    } catch (error) {
        console.error('Error handling image upload:', error);
        res.status(500).send('Error handling image upload.');
    }
});

// Route to fetch the profile picture
app.get('/api/profile-picture/:customerId', authenticateToken, fetchLimiter, async (req: Request, res: Response) => {
    try {
        const customer = req.customer;
        if (!customer) {
            res.status(401).send(`No customer found`);
            return;
        }

        if (customer.id !== req.params.customerId) {
            res.status(403).send('Forbidden');
            return;
        }

        if (!customer || !customer.profilePictureUrl) {
            res.status(404).send('Profile picture not found.');
            return;
        }

        const file = bucket.file(customer.profilePictureUrl.split(`https://storage.googleapis.com/${bucket.name}/`)[1]);
        const [exists] = await file.exists();

        if (!exists) {
            res.status(404).send('Profile picture not found.');
            return;
        }

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500' // URL valid until this date
        });

        res.status(200).send({ url });
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).send('Error fetching profile picture.');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});