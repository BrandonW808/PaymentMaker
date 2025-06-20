import mongoose, { Schema, Document, model } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string; // Ensure JWT_SECRET is a string

export interface ICustomer extends Document {
    name: string;
    email: string;
    address: string;
    phone: string;
    password: string;
    stripeCustomerId?: string; // Added Stripe customer ID
    profilePictureUrl?: string;
    generateAuthToken(): string;
}

const CustomerSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String },
    stripeCustomerId: { type: String, unique: true, sparse: true }, // Stripe customer ID
    profilePictureUrl: { type: String }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ name: 'text', email: 'text' });
CustomerSchema.index({ stripeCustomerId: 1 });

CustomerSchema.pre<ICustomer>('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

CustomerSchema.methods.generateAuthToken = function () {
    return jwt.sign({ id: this._id }, JWT_SECRET, { expiresIn: '7d' });
};

export default model<ICustomer>('Customer', CustomerSchema);
