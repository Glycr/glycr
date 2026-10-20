const mongoose = require('mongoose');

let gfs;
mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
});

const uploadToGridFS = (file, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = gfs.openUploadStream(filename, {
      contentType: file.mimetype
    });
    uploadStream.end(file.buffer);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.on('error', reject);
  });
};

const getFileById = async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const file = await gfs.find({ _id: fileId }).toArray();
    if (!file || file.length === 0) {
      console.error('File not found in GridFS:', req.params.id);
      return res.status(404).send('File not found');
    }

    const mimeTypes = {
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'application/pdf': 'application/pdf'
    };
    res.setHeader('Content-Type', mimeTypes[file[0].contentType] || 'application/octet-stream');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    gfs.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(400).send('Invalid file ID');
  }
};

module.exports = { uploadToGridFS, getFileById };
