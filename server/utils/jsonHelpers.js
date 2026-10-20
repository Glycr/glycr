const readCollection = async (Model) => {
  try {
    return await Model.find().lean();
  } catch (err) {
    console.error(`Error reading ${Model.modelName}:`, err);
    return [];
  }
};

const writeDocument = async (Model, document) => {
  try {
    await Model.create(document);
  } catch (err) {
    console.error(`Error writing to ${Model.modelName}:`, err);
    throw err;
  }
};

const updateDocument = async (Model, filter, update) => {
  try {
    await Model.updateOne(filter, { $set: update });
  } catch (err) {
    console.error(`Error updating ${Model.modelName}:`, err);
    throw err;
  }
};

const deleteDocument = async (Model, filter) => {
  try {
    await Model.deleteOne(filter);
  } catch (err) {
    console.error(`Error deleting from ${Model.modelName}:`, err);
    throw err;
  }
};

module.exports = { readCollection, writeDocument, updateDocument, deleteDocument };
