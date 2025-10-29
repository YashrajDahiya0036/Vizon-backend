- make folder in src
```mkdir controllers middlewares models routes utils```
- make files in src
```touch app.js constants.js index.js```

- ```.prettierrc``` configs 
```
{
	"singleQuote": false,
	"bracketSpacing": true,
	"tabWidth": 4,
	"semi": true,
	"trailingComma": "es5"
}
```

- when connecting to atlas if providing dbName provide it as
```
const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`,{
			dbName:DB_NAME
		})
```

- when using multer use same name for the upload fileds name and the file names