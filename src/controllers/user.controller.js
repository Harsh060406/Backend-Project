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

const changeUserPassword = asynchandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const passwordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!passwordCorrect){
        throw new APIError(400, "Invalid password!")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new APIResponse(200, {}, "Password changed successfully!"))
})

const getCurrentUser = asynchandler(async (req, res) => {
    return res
    .status(200)
    .jason(200, req.user, "Current user fetched successfully!")
})

const updateAccountDetails = asynchandler(async (req, res) => {
    const {fullName, email} = req.body
    if(!fullName || !email){
        throw new APIError(400, "All fields are required!")
    }
    const user = User.findById(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new APIResponse(200, user, "Account details updated successfully!")
    )
})

const updateUserAvatar = asynchandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new APIError(400, "Avatar file is missing!")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new APIError(400, "Error while uploading avatar!")
    }
    const user = User.findById(
        req.user?._id,
        {
            $set: {
                avatar = avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new APIResponse(200, user, "Avatar Image updated successfully!")
    )
})

const updateUserCoverImage = asynchandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new APIError(400, "Cover mage file is missing!")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new APIError(400, "Error while uploading Cover Image!")
    }
    const user = User.findById(
        req.user?._id,
        {
            $set: {
                coverImage = coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new APIResponse(200, user, "Cover Image updated successfully!")
    )
})

const getUserChannelProfile = asynchandler(async (req, res) => {
    const {username} = req.params
    if(!username?.trim()){
        throw new APIError(400, "Username is missing!")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "susbscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "susbscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!chnnael?.length){
        throw new APIError(400, "Channel does not exist!")
    }

    return res
    .status(200)
    .json(
        new APIResponse(200, channel[0], "User channel fetched successfully!")
    )
})

const getWatchHistory = asynchandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new APIResponse(200, user[0].watchHistory, "Watch history fetched successfully!")
    )
})

export {registerUser, loginUser, logoutUser, refreshAccessToken, changeUserPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory}