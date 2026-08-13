import { asynchandler } from "../utils/asynchandler.js"
import {User} from "../models/user.model.js"
import { APIError } from "../utils/APIError.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asynchandler(async (req, res, next) => {
    try{
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        if(!token){
            throw new APIError(404, "Unauthorized request!")
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if(!user){
            throw new APIError(404, "Invalid Access Token")
        }

        req.user = user
        next()
    }
    catch(error){
        throw new APIError(401, error?.message || "Invalid access token!")
    }
})