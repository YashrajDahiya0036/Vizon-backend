import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return "Could not find the local path";
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath); //remove the local path
        console.log("file removed", error);
        return null;
    }
};

function getPublicIdFromUrl(url) {
  const parts = url.split('/');
  const fileWithExtension = parts.slice(7).join('/'); // Skip the first 7 parts of the Cloudinary URL
  const publicId = fileWithExtension.replace(/\.[^/.]+$/, ''); // Remove file extension
  return publicId;
}


const deleteFromCloudinary = async (url) => {
	const assestId = getPublicIdFromUrl(url)
    try {
        const response = await cloudinary.uploader.destroy(assestId);
        return response;
    } catch (error) {
        console.error("Error while deleting files from cloudinary.", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };
