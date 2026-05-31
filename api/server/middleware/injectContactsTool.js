const { searchContactsForAssistant } = require('@librechat/api');
const { searchContactsTool } = require('@librechat/api');

module.exports = function injectContactsTool(req, _res, next) {
  if (!req.user?.id) return next();

  req.contactsTool = searchContactsTool;

  req.handleContactsToolCall = async (toolCall) => {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const results = await searchContactsForAssistant(
        req.user.id,
        args.query,
        Math.min(args.limit ?? 10, 20),
      );
      return JSON.stringify(results);
    } catch (err) {
      return JSON.stringify({ error: err.message });
    }
  };

  next();
};