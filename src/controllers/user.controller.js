import {asynchandler} from '../utils/asynchandler.js';
import {APIError} from '../utils/APIError.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {APIResponse} from '../utils/APIResponse.js'
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken
        const refreshToken = user.generateRefreshToken

        user.refreshToken = refreshToken
        user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}
    }
    catch(error){
        throw new APIError(500, "Something went wrong while generating refresh and access token!")
    }
}

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

const loginUser = asynchandler(async (req, res) => {
    const {email, username, password} = req.body
    if(!username && !email){
        throw new APIError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new APIError(404, "User does not exist!")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new APIError(404, "Invalid user credentials!")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true, 
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
        new APIResponse(200,{
            user: loggedInUser, accessToken, refreshToken
        }, "User logged in successfully!")
    )
})

const logoutUser = asynchandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true, 
        secure: true
    } 
    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
        new APIResponse(200, {}, "User logged out!")
    )
})

const refreshAccessToken = asynchandler(async (req, res) => {
    try{
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if(!incomingRefreshToken){
            throw new APIError(401, "Unauthtorized request!")
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if(!user){
            throw new APIError(401, "Invalid refresh token!")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new APIError(401, "Refreshtoken is expired or used!")
        }

        const options = {
            httpOnly: true, 
            secure: true
        }

        const {accesToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

        return res
        .status(200)
        .cookies("accessToken", accesToken, options)
        .cookies("refreshToken", newRefreshToken, options)
        .json(
            new APIResponse(
                200, 
                {accesToken, refreshToken: newRefreshToken},
                "Access token refreshed successfully"
            )
        )
    }
    catch(error){
        throw new APIError(401, error?.message || "Inavlid refresh token!")
    }
})

export {registerUser, loginUser, logoutUser, refreshAccessToken}