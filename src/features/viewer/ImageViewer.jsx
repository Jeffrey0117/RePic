import { motion } from 'framer-motion';

export const ImageViewer = ({ src }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-full max-h-[80vh] relative shadow-2xl rounded-lg overflow-hidden"
        >
            <img
                src={src}
                alt="View"
                className="max-w-full max-h-[80vh] object-contain block" // Ensure block to remove bottom spacing
            />
        </motion.div>
    );
};
