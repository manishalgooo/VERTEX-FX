import User from "../models/user.models.js";
import jwt from "jsonwebtoken";
import responseHelper from "../helpers/response.helper.js";
import hashPassword from "../middleware/hashPassword.js";
import { MESSAGE } from "../helpers/message.helper.js";
import generateOtp from "../utils/generateOtp.js";
import Fast2SendOtp from "../utils/Fast2SendOtp.js";
import validateFields from "../middleware/validateFields.js";
import watchList from "../models/watchList.models.js";
const { send200, send403, send400, send401, send404, send500 } = responseHelper;

const register = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return send400(res, {
        status: false,
        message: MESSAGE.FIELDS_REQUIRED,
      });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return send400(res, {
        status: false,
        message: MESSAGE.USER_EXISTS,
      });
    }
    const encryptedPassword = await hashPassword.encrypt(password);
    const newUser = new User({
      fullName,
      email,
      password: encryptedPassword,
    });
    const user = await newUser.save();
    const token = jwt.sign(
      {
        _id: user._id,
      },
      process.env.JWT_SECRET
    );

    res
      .header("auth-token", token)
      .status(201)
      .json({
        status: true,
        token: token,
        message: `${MESSAGE.USER_REGISTERED}. ${MESSAGE.VERIFY_NUMBER}`,
        data: user,
      });
  } catch (error) {
    return send400(res, {
      status: false,
      message: error.message,
    });
  }
};
const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  const userId = req.user._id;
  try {
    if (!phoneNumber || !validateFields.validatePhoneNumber(phoneNumber)) {
      return send400(res, {
        status: false,
        message: MESSAGE.INVALID_NUMBER,
      });
    }

    const userData = await User.findOne({ phoneNumber });
    if (userData) {
      if (
        userData.phoneNumber === phoneNumber &&
        userData.isPhoneNumberVerified
      ) {
        return send400(res, {
          status: false,
          message: MESSAGE.PHONE_EXISTS,
        });
      }
    }
    const newOtp = generateOtp(4);
    await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          otp: newOtp,
          new: true,
          phoneNumber,
        },
      }
    );
    await Fast2SendOtp({
      message: `Your OTP for Stockology is ${newOtp}`,

      contactNumber: phoneNumber,
    });
    return send200(res, {
      status: true,
      message: MESSAGE.OTP_SENT,
    });
  } catch (error) {
    return send400(res, {
      status: false,
      message: error.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user._id;
  try {
    const user = await User.findOne({
      _id: userId,
    });
    if (!user) {
      return send404(res, {
        status: false,
        message: MESSAGE.USER_NOT_FOUND,
      });
    }
    if (!otp) {
      return send400(res, {
        status: false,
        message: MESSAGE.ENTER_OTP,
      });
    }
    if (otp !== user.otp) {
      return send400(res, {
        status: false,
        message: MESSAGE.INVALID_OTP,
      });
    }
    await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          isProfileComplete: true,
          new: true,
          otp: null,
          joinedOn: new Date(),
          isPhoneNumberVerified: true,
        },
      }
    );
    const data = await User.findOne({ _id: userId });
    const token = jwt.sign(
      {
        _id: user._id,
      },
      process.env.JWT_SECRET
    );

    const symbols = [
      "SBIN.NS",
      "RELIANCE.NS",
      "TCS.NS",
      "ICICIBANK.NS",
      "HDFCBANK.NS",
      "BAJFINANCE.NS",
      "SUZLON.NS",
    ];

    const watchlistObjects = symbols.map((symbol) => ({
      symbol,
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await watchList.insertMany(watchlistObjects);

    res.header("auth-token", token).status(200).json({
      status: true,
      token: token,
      message: MESSAGE.PHONE_VERIFICATION,
      data,
    });
  } catch (error) {
    return send400(res, {
      status: false,
      message: error.message,
    });
  }
};
const getUserProfile = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return send404(res, {
        status: false,
        message: MESSAGE.USER_NOT_FOUND,
      });
    }
    return send200(res, {
      status: true,
      message: MESSAGE.USER_PROFILE,
      data: user,
    });
  } catch (error) {
    return send400(res, {
      status: false,
      message: error.message,
    });
  }
};
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return send400(res, {
      status: false,
      message: MESSAGE.FIELDS_REQUIRED,
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return send404(res, {
        status: false,
        message: MESSAGE.USER_NOT_FOUND,
      });
    }

    const validPass = await hashPassword.compare(password, user.password);

    if (!validPass) {
      return send400(res, {
        status: false,
        message: MESSAGE.LOGIN_ERROR,
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
      },
      process.env.JWT_SECRET
    );

    res.header("auth-token", token).status(200).json({
      status: true,
      token,
      message: MESSAGE.LOGIN_SUCCESS,
      data: user,
    });
  } catch (error) {
    return send400(res, {
      status: false,
      message: error.message,
    });
  }
};

const userController = {
  register,
  sendOtp,
  verifyOtp,
  getUserProfile,
  login,
};

export default userController;
