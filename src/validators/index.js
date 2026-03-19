const validator = require("node-input-validator");
const ResponseMiddleware = require("../middleware/ResponseMiddleware.js");
const helpers = require("../util/helper.js");
const { models } = require("../models");

validator.extend("unique", async function ({ value, args }) {
  console.log("ValidatorsIndex => unique", args);
  console.log(args);

  const modelName = args[0];
  const field = args[1];
  const excludeField = args[2];
  const excludeValue = args[3];

  if (!models[modelName] || !field) return false;

  const query = { [field]: value };
  if (excludeField && excludeValue) query[excludeField] = { $ne: excludeValue };

  const exists = await models[modelName].exists(query);
  return exists ? false : true;
});

/**
 * to check given id exists in given table
 * additional column checks can be passed in pairs
 * e.g exists:table_name,primary_id,col1,value1,col2,value2 and so on
 * col-value must be in pairs
 */
validator.extend("exists", async function ({ value, args }) {
  console.log("ValidatorsIndex => exists");
  console.log(value);
  console.log(args);

  const modelName = args[0];
  const field = args[1];
  if (!models[modelName] || !field) return false;

  const exists = await models[modelName].exists({ [field]: value });
  return exists ? true : false;
});

validator.extend("allowedValues", ({ value, args }) => {
  return args.indexOf(value) > -1 ? true : false;
});

validator.extendMessages(
  {
    required: "The :attribute field must not be empty.",
    email: "E-mail must be a valid email address.",
    exists: "The :attribute is not found!",
    allowedValues: "The :attribute must be one of the following: :args.",
  },
  "en"
);
module.exports = {
  //common function to send validation response
  validate: (v, res, next, req = null) => {
    console.log("ValidatorsIndex => validate");

    if (
      v.check().then(function (matched) {
        if (!matched) {
          if (!req) req = {};
          req.rCode = 0;
          let message = helpers().getErrorMessage(v.errors);

          ResponseMiddleware(req, res, next, message);
        } else {
          next();
        }
      })
    );
  },

  validations: {
    general: {
      requiredNumeric: "required|numeric",
      requiredBoolean: "required|boolean",
      requiredInt: "required|integer",
      requiredString: "required|string|maxLength:255",
      requiredStrings: "required|string",
    },
    user: {
      id: "required|string|exists:User,_id|maxLength:250",
      email: "required|string|unique:User,email|maxLength:50",
      uniqMobile:
        "required|numeric|unique:User,mobile|minLength:10|maxLength:10",
      existsUsername: "required|string|exists:User,username|maxLength:50",
      existsmobile: "required|string|exists:User,mobileNumber|maxLength:50",
      role: "required|string|allowedValues:Admin,Manager,Agent",
    },
    address: {
      id: "required|string|exists:UserAddress,_id|maxLength:250",
    },
    admin: {
      existsEmail: "required|email|exists:Admin,email|maxLength:50",
    },
    banner: {
      id: "required|string|exists:Banners,_id|maxLength:250",
    },
  },
};

// comment