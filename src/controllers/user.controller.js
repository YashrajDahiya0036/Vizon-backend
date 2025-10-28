import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

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
            (field) => field?.trim() === ""
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
        req.files.coverImage.lenght > 0
    )
        coverLocalPath = req.files.coverImage[0].path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar required.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar required.");
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

    if (!email && !username) {
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
    User.findByIdAndUpdate(
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

export { registerUser, loginUser, logoutUser };
