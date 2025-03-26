import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 8080;

dotenv.config();



// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.urlencoded({ extended: true })); // Parses form data
app.use(express.json()); // Parses JSON data

// Multer config
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'public/uploads/'); // ensures files go to "public/uploads"
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage });

// PostgreSQL
// Load environment variables from .env file using ES modules syntax



const { Client } = pg;
// Check if DATABASE_URL is defined; if not, log a warning.
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is undefined. Please set this variable in your Railway project settings."
  );
}
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});



db.connect(err => {
  if (err) {
    console.error('Connection error:', err.stack);
  } else {
    console.log('Connected to PostgreSQL');
  }
});


// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/login.html"));
});
app.get("/explore", (req, res) => {
  res.sendFile(path.join(__dirname, "/explore.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "/login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "/signup.html"));
});

app.get("/index", (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "/host.html"));
});
app.get("/add-listing", (req, res) => {
  res.sendFile(path.join(__dirname, "/explore.html"));
});
app.get("/bg-img", (req, res) => {
  res.sendFile(path.join(__dirname, "/bakground.webp"));
});

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !email || !phone || !password) {
      return res.send(`<script>alert("All fields are required."); window.location.href='/signup';</script>`);
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      return res.send(`<script>alert("Phone number must be exactly 10 digits."); window.location.href='/signup';</script>`);
    }

    if (password.length < 6) {
      return res.send(`<script>alert("Password must be more than 6 characters."); window.location.href='/signup';</script>`);
    }

    const existingUser = await db.query("SELECT * FROM users WHERE mobile_number = $1", [phone]);
    if (existingUser.rows.length > 0) {
      return res.send(`<script>alert("Account already exists."); window.location.href='/signup';</script>`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, mobile_number, password) VALUES ($1, $2, $3, $4)",
      [username, email, phone, hashedPassword]
    );

    res.redirect("/index");
  } catch (err) {
    console.error("Signup Error:", err);
    res.send(`<script>alert("Something went wrong. Please try again."); window.location.href='/signup';</script>`);
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.send(`<script>alert('Account not found'); window.location.href='/login';</script>`);
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      return res.redirect("/index");
    } else {
      return res.send(`<script>alert('Wrong password'); window.location.href='/login';</script>`);
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).send("Server error");
  }
});


// Add listing
// app.post('/add-listing', upload.single('image'), async (req, res) => {
//   try {
//     const { title, location , description } = req.body;
//     const image = req.file ? req.file.filename : null;
// console.log(req.body.location);
//     await db.query(
//       'INSERT INTO details (title, location, image, description) VALUES ($1, $2, $3, $4)',
//       [title, location ,image , description,]
//     );
//     res.json({
//       title,
//       location,
//       description,
//       image: `/public/uploads/${image}`
//     });
//   } catch (err) {
//     console.error('Error saving listing:', err);
//     res.status(500).json({ error: 'Error saving listing' });
//   }
// });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const uploadDir = path.join(__dirname, "uploads");
// Create the uploads directory if it doesn't exist.
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage for file uploads.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename using the current timestamp.
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Route to insert product data into the "products" table.
app.post("/api/products", upload.single("productImage"), async (req, res) => {
  const {
    productName,
    productPrice,
    productQuality,
    productDescription,
    contactNumber,
    priceCurrency,
   
  } = req.body;
  const imagePath = req.file ? "/uploads/" + req.file.filename : "";
console.log(imagePath);
  try {
    // Convert price and quantity to float numbers.
    const parsedPrice = parseFloat(productPrice);


    // Validate that the entered price and quantity are within allowed limits.
    const maxAllowedPrice = 20000;

 if (parsedPrice > maxAllowedPrice) {
      return res.send(
       ` <script>alert("Max allowed price: ₹${maxAllowedPrice}"); window.location.href='/sell';</script>`
      );
    } else {
      // Insert the product into the "products" table.
      const insertQuery = `
        INSERT INTO products
          (product_name, price, quality, description, contact_number, image, currency)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `;
      const values = [
        productName,
        parsedPrice,
        
      productQuality,
        productDescription,
        contactNumber,
        imagePath,
        priceCurrency,
        
      ];
      await db.query(insertQuery, values);
      res.redirect("/explore");
    }
  } catch (error) {
    console.error("Error inserting product:", error);
    res.status(500).send("Server error");
  }
});

// Route to fetch all products from the "products" table.
app.get("/api/products", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server error");
  }
});
// Default route: serve the index page.
app.get("/", (req, res) => {
  res.sendFile("index.html");
});
app.get("/favicon.ico", (req, res) => res.status(204).end());
// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
// Route to fetch all products from the "products" table.
// app.get("/api/products", async (req, res) => {
//   try {
//     const result = await db.query("SELECT * FROM products ORDER BY id DESC");
//     res.json(result.rows);
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     res.status(500).send("Server error");
//   }
// });
// Default route: serve the index page.
