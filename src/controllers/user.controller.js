import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {
    deleteFromCloudinary,
    uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (id) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            throw new ApiError(400, "User not found to generate tokens.");
        }

        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Could not generate Access and Refresh Token");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok",
    // });

    // get the data
    const { fullName, email, username, password } = req.body;

    // if(fullName===''){
    // 	throw new ApiError(400,"fullName is empty")
    // }
    // validation
    if (
        [fullName, email, username, password].some(
            (field) => !field || field.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    // checking if the user already exists and checks the required fields
    const existingUser = await User.findOne({ $or: [{ email, username }] });
    if (existingUser) {
        throw new ApiError(409, "User Already Exists.");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverLocalPath = req.files?.coverImage[0]?.path;
    let coverLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, `Avatar required.`);
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar not uploaded on cloudinary.");
    }

    // creating the user
    const user = await User.create({
        fullName,
        email,
        password,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    // checking if the user was created
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!userCreated) {
        throw new ApiError(500, "Error ocurred during creating the User.");
    }

    // returning the result
    return res
        .status(201)
        .json(new ApiResponse(200, userCreated, "User Created Successfully."));
});

const loginUser = asyncHandler(async (req, res) => {
    // get the data
    const { email, username, password } = req.body;

    if (!(email || username)) {
        throw new ApiError(400, "Provide email or a username.");
    }
    if (!password) {
        throw new ApiError(400, "Password is required.");
    }
    // if([email,username,password].some((field)=> field?.trim() === "")){
    // 	throw new ApiError(400,"All fields are required.")
    // }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "No User found.Go to sign up page");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Wrong Password.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    // if this call is expensive just update the user here as the current reference of the user does not have the tokens
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // options for cookies
    const options = {
        // now the cookies can only be modified by the server but can be accessed on client side
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in Successfully."
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    await User.findByIdAndUpdate(
        userId,
        {
            $unset: {
                refreshToken: 1,// this removes the field 
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken._id);
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token.");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used.");
        }

        const options = {
            httpOnly: true,
            secure: true,
        };

        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken,
                    },
                    "Access Token refreshed."
                )
            );
    } catch (error) {
        console.error(error);
        throw new ApiError(401, "Could not refresh the access tokens.");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Incorrect Password.");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed Successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Current User fetched Successfully.")
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All field are required.");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
            },
        },
        { new: true }
    ).select("-password");

    res.status(200).json(
        new ApiResponse(200, user, "Account Updated Successfully.")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File not found.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError("Avatar was not uploded on Cloudinary.");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(400, "User not found.");
    }

    const oldAvatarUrl = user.avatar;

    user.avatar = avatar.url;
    await user.save({ validateBeforeSave: false });

    if (oldAvatarUrl) {
        deleteFromCloudinary(oldAvatarUrl);
    }

    const updatedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    res.status(200).json(
        new ApiResponse(200, updatedUser, "Avatar updated Successfully.")
    );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file not found.");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage?.url) {
        throw new ApiError(400, "Cover image was not uploaded to Cloudinary.");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    const oldCoverImageUrl = user.coverImage;

    user.coverImage = coverImage.url;
    await user.save({ validateBeforeSave: false });

    if (oldCoverImageUrl) {
        deleteFromCloudinary(oldCoverImageUrl);
    }

    const updatedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "✅ Cover image updated successfully."
            )
        );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing.");
    }

    const channel = await User.aggregate([
        // the different stages of aggregation are pipelines
        // pipeline 1 - to find the user
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        // pipeline 2 - to create field of subscribers
        {
            // checking the documents of subscription model to find the number of
            // subscribers and the channels which the current user has subscribed to.

            // the documents in subscription model looks like
            // {subscriber: user._id, channel: user._id}
            // if we search the name of the current user with channel the we get the
            // no of subscriber

            // Ex-{subsciber-UserA,channel-User100},{subscriber-UserC,channel-User100}
            // so here searching of User100 will give us 2 subscriber.
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        // pipeline 3 - to create field of subscribedTo
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        //pipeline 4 - now we add these new fields to the user
        {
            $addFields: {
                subscribersCount: {
                    // counts the no of documents
                    $size: "$subscribers",
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                // it gives true or false value to see if the current user is subscribed to a certain channel
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        else: true,
                        then: false,
                    },
                },
            },
        },
        // pipeline 5 - returning the selected fields
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exists.");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200),
            channel[0],
            "User channel fetched successfully."
        );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        // firstly get the user
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            // access the current user watchHistory(which is ids of videos) as:watchHistory this replaces the ids with the array of full video document
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                // this runs on the new watchHistory array to find the owner for that video
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            // this filters the result to contain only specified values
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        // this converts the array of objects to object as this was recieved as a array
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch Hisory fetched successfully."
            )
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
};
