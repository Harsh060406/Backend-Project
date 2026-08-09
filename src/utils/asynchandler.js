export {asynchandler}


const asynchandler = (fn) => async (req, res, next) => {
    try{
        await fn(req, res, next)
    }
    catch(error){
        const statusCode = typeof error.code === 'number' ? error.code : 500;
        res.status(statusCode).json({
            sucess: false,
            message: error.message || "Internal Server Error"
        })
    }
}