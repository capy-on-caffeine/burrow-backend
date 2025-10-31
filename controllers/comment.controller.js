import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js'; // We need this to update the post's comment array

// Get all comments for a specific post
export const getCommentsForPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.find({ post: postId })
                                  .populate('author', 'username'); // Populate author info
    if (!comments) {
      return res.status(404).json({ message: 'No comments found for this post' });
    }
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching comments', error: error.message });
  }
};

// New: Update a comment's vote
export const updateCommentVote = async (req, res) => {
  try {
    const { id } = req.params;
    // 'direction' will be 'up' or 'down'. 
    // 'currentVote' will be 'up', 'down', or null to handle toggling.
    const { direction } = req.body; 

    let update;
    if (direction === 'up') {
      update = { $inc: { votes: 1 } };
    } else if (direction === 'down') {
      update = { $inc: { votes: -1 } };
    } else {
      return res.status(400).json({ message: 'Invalid vote direction' });
    }
    
    // Find, update, and return the new document
    const updatedComment = await Comment.findByIdAndUpdate(id, update, { new: true })
                                      .populate('author', 'username');

    if (!updatedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.status(200).json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating vote', error: error.message });
  }
};

// New: Update comment text
export const updateCommentText = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText } = req.body;

    if (!commentText || commentText.trim() === '') {
      return res.status(400).json({ message: 'Comment text cannot be empty' });
    }

    // In a real app, you would also verify that the logged-in user
    // is the author of this comment before allowing an update.

    const updatedComment = await Comment.findByIdAndUpdate(
      id,
      { commentText },
      { new: true, runValidators: true } // runValidators ensures new text meets schema rules
    ).populate('author', 'username');

    if (!updatedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.status(200).json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating comment', error: error.message });
  }
};

// New: Delete a comment
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real app, you'd verify user ownership here too.

    const deletedComment = await Comment.findByIdAndDelete(id);

    if (!deletedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // --- Clean up references ---
    
    // 1. Remove this comment's ID from its parent Post's `comments` array
    // (This only applies if it was a top-level comment)
    await Post.findByIdAndUpdate(deletedComment.post, {
      $pull: { comments: deletedComment._id },
    });

    // 2. Recursively delete all child comments
    // We create a helper function to find and delete all descendants
    const deleteChildren = async (parentId) => {
      const children = await Comment.find({ parentComment: parentId });
      for (const child of children) {
        await deleteChildren(child._id); // Recurse
        await Comment.findByIdAndDelete(child._id); // Delete child
      }
    };
    
    await deleteChildren(id); // Start the recursive delete

    res.status(200).json({ message: 'Comment and all replies successfully deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting comment', error: error.message });
  }
};
