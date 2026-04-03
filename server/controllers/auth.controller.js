const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, firmName: user.firmName },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

exports.register = async (req, res) => {
  try {
    const { firmName, email, password } = req.body;

    if (!firmName || !email || !password) {
      return res.status(400).json({ message: "Firm name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ firmName, email, password: hashed });
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, firmName: user.firmName, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);

    res.json({
      token,
      user: { id: user._id, firmName: user.firmName, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id, firmName: user.firmName, email: user.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
