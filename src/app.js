import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true, limit: '10mb'}));
app.use(express.static('public'));

import userRoutes from './routes/user.routes.js';

app.use("/api/v1/user", userRoutes);

// http://localhost:8000/api/v1/user/register

export {app} 