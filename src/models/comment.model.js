import mongoose, {Schema} from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const commnetSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: "Video"
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "Video"
    }
},
{
    timestamps: true
})

commentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commnetSchema)