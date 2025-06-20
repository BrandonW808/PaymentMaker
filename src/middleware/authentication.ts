import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Customer, { ICustomer } from '../models/Customer';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string; // Ensure JWT_SECRET is a string

// Extend the Request interface to include the customer property
declare global {
    namespace Express {
        interface Request {
            customer?: ICustomer;
        }
    }
}

// Middleware to authenticate and authorize requests
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.sendStatus(401);
        return;
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

        // Find the customer by the decoded ID
        const customer = await Customer.findById(decoded.id);

        // If customer is not found, return a 401 Unauthorized response
        if (!customer) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        req.customer = customer;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: 'Invalid token' });
    }
};