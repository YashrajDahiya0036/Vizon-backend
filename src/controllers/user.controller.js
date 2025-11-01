import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {
    deleteFromCloudinary,
    uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

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
            $set: {
                refreshToken: undefined,
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
};
