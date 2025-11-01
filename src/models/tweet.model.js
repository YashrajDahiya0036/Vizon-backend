import mongoose from "mongoose";

const tweetSchema = mongoose.Schema(
	{
		content: {
			type: String,
			required: [true, "Tweet can not be empty."],
		},
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{ timestamps: true }
);

export const Tweet = mongoose.model("Tweet", tweetSchema);
