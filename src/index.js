import mongoose from "mongoose";
import 'dotenv/config'
import connectDB from "./db/index.js";
import { app } from "./app.js";

connectDB().then(()=>{
	app.listen(process.env.PORT || 8000,()=>{
		console.log(`Server is running at port ${process.env.PORT}`)
	})
}).catch((e)=>{console.log("Mongo db connection failed.",e)})

// (async ()=>{
// 	try {
// 		await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
// 	} catch (error) {
// 		console.error(error)
// 		throw error
// 	}
// })()