import mongoose from "mongoose";

const playlistSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Enter playlist name."],
        },
        description: {
            type: String,
        },
        videos: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video",
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export const Playlist = mongoose.model("Playlist", playlistSchema);
