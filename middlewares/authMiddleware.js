const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

const authMiddleware = (req, res, next) => {
  try {
    const token =
       req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return next(new AppError("You are not authorized to access this route", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

     req.user = decoded;
    console.log(decoded);

    next();
  } catch (error) {
    return next(new AppError("You are not authorized to access this route", 401));
  }

}
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new AppError("You are not authorized to access this route", 401));
  }
  next();
};


module.exports = { authMiddleware, isAdmin };
 