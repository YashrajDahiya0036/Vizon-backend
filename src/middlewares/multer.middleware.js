import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp");
    },
    filename: function (req, file, cb) {
        // const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);//to add a unique id maybe using nano id,used to prevent overwrite of the files of same name
        cb(null, file.originalname);
    },
});

export const upload = multer({ storage: storage });
