import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commnetSchema = mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, "Comment can not be empty."],
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

commnetSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commnetSchema);
