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

# 📘 HTTP Status Codes Cheat Sheet

## ✅ Success (2xx)
| Code | Meaning | Description |
|------|----------|-------------|
| **200** | OK | Request succeeded, data returned successfully |
| **201** | Created | Resource created successfully (e.g. user registered) |
| **202** | Accepted | Request accepted but still processing |
| **204** | No Content | Request succeeded, but no data to return |

---

## ⚠️ Client Errors (4xx)
| Code | Meaning | Description |
|------|----------|-------------|
| **400** | Bad Request | Invalid input or missing fields |
| **401** | Unauthorized | Authentication failed or **session expired** |
| **403** | Forbidden | Authenticated but not allowed to access resource |
| **404** | Not Found | Resource or endpoint doesn’t exist |
| **405** | Method Not Allowed | HTTP method not supported (e.g. GET instead of POST) |
| **409** | Conflict | Duplicate resource or data conflict (e.g. user already exists) |
| **410** | Gone | Resource was deleted and no longer available |
| **422** | Unprocessable Entity | Validation failed (e.g. malformed data) |
| **429** | Too Many Requests | Rate limit exceeded (too many requests) |

---

## ❌ Server Errors (5xx)
| Code | Meaning | Description |
|------|----------|-------------|
| **500** | Internal Server Error | Generic server failure or uncaught exception |
| **501** | Not Implemented | Endpoint or method not supported yet |
| **502** | Bad Gateway | Invalid response from an upstream server |
| **503** | Service Unavailable | Server temporarily down (maintenance or overload) |
| **504** | Gateway Timeout | Upstream server took too long to respond |

---

### 🧠 Notes
- **2xx** → Request was successful.  
- **4xx** → Client made a bad request.  
- **5xx** → Server encountered an error.  

---

**Author:** Your Name  
**Purpose:** Quick reference for API development
