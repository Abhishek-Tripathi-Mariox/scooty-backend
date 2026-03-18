const messages = require("../util/messages");

module.exports = (req, res, next, customMsg = '') => {

  const data = req.rData ? req.rData : {};
  const code = req.rCode != undefined ? req.rCode : 1;
  
  // Use permissionError for more specific permission denied messages
  let message = customMsg
    ? customMsg
    : req.permissionError 
      ? req.permissionError
      : req.msg && messages()[req.msg]
        ? messages()[req.msg]
        : req.msg || "success";

  if (code == 3) {
    res.status(401).send({ code, message, data });
  } else if (code == 4) {
    res.status(403).send({ code, message, data });
  } else if (code == 0) {
    res.status(400).send({ code, message, data });
  } else if (code == 5) {
    res.status(404).send({ code, message, data });
  } else {
    res.send({ code, message, data });
  }
};
