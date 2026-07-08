import MakerCheckerRequest from '../models/MakerCheckerRequest.js';

export const makerChecker = (actionType, targetModel) => {
  return async (req, res, next) => {
    try {
      // 1. Owners bypass the Maker-Checker flow entirely
      if (req.user && req.user.role === 'Owner') {
        return next();
      }

      // 2. Extract targetId if present in route parameters
      const targetId = req.params.id || null;

      // 3. Create the pending MakerCheckerRequest in the database
      // proposedData saves the request payload so it can be replayed on approval
      const request = await MakerCheckerRequest.create({
        actionType,
        targetModel,
        targetId,
        proposedData: {
          body: req.body,
          params: req.params,
          query: req.query
        },
        maker: req.user._id,
        status: 'Pending',
      });

      // 4. Return 202 Accepted with the request details
      return res.status(202).json({
        message: 'Request submitted for verification.',
        requestId: request._id,
        status: 'Pending',
        actionType,
        targetModel,
      });
    } catch (error) {
      console.error('Error in Maker-Checker middleware:', error);
      return res.status(500).json({ 
        message: 'Internal Server Error in security interceptor', 
        error: error.message 
      });
    }
  };
};

export default makerChecker;
