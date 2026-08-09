import {asynchandler} from '../utils/asynchandler.js';
import {APIError} from '../utils/APIError.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {APIResponse} from '../utils/APIResponse.js'
import { User } from "../models/user.model.js";

const registerUser = asynchandler(async (req, res) => {
    const {fullName, email, username, password} = req.body;
    console.log("email", email)

    if([fullName, email, username, password].some(field => field?.trim() === "")){
        throw new APIError(400, "All fields are required!")
    }
    const existingUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if(existingUser){
        throw new APIError(409, "User with this email or username already exists!")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if(!avatarLocalPath){
        throw new APIError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new APIError(400, "Avatar is required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar?.url || avatar, 
        coverImage: coverImage?.url || coverImage || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new APIError(500, "Something went wrong while registering the user!")
    }

    return res.status(201).json(
        new APIResponse(200, createdUser, "User registered successfully!")
    )
})

export {registerUser}