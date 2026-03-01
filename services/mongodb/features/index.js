const { v4: uuidv4 } = require('uuid');

// Helper: convert query params from string (like "?queries=[...]")
function asTupleArray(val, eachLenMin, fallback) {
  let arr = val;
  if (typeof val === 'string') {
    try {
      let decodedVal = decodeURIComponent(val);
      if (decodedVal.startsWith('"') && decodedVal.endsWith('"')) {
        decodedVal = decodedVal.slice(1, -1);
      }
      decodedVal = decodedVal.replace(/\\"/g, '"');
      arr = JSON.parse(decodedVal);
    } catch (e) {
      return fallback;
    }
  }
  if (!Array.isArray(arr)) return fallback;
  return arr.filter(x => Array.isArray(x) && x.length >= eachLenMin && typeof x[0] === 'string');
}

// Helper function to parse sorts (supports both object and tuple formats)
function parseSorts(val) {
  let arr = val;
  if (typeof val === 'string') {
    try {
      let decodedVal = decodeURIComponent(val);
      if (decodedVal.startsWith('"') && decodedVal.endsWith('"')) decodedVal = decodedVal.slice(1, -1);
      decodedVal = decodedVal.replace(/\\"/g, '"');
      arr = JSON.parse(decodedVal);
    } catch (error) {
      console.error('Failed to parse sorts string:', error);
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (item && typeof item === 'object' && 'field' in item) {
      return [item.field, item.direction || 'asc'];
    }
    if (Array.isArray(item) && item.length >= 1 && typeof item[0] === 'string') {
      return [item[0], item[1] || 'asc'];
    }
    return null;
  }).filter(i => i !== null);
}

// Make string → correct JS type
function coerceValue(v) {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (s === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^\d{4}-\d{2}-\d{2}T.*Z?$/.test(s)) return new Date(s);
  return v;
}

class MongooseFeatures {
  // Pagination & filtering
  async PaginateHandler(model, perPage = 15, currentPage = 1, sortsIn = [], queriesIn = []) {
    try {
      const queries = asTupleArray(queriesIn, 3, []);
      const sorts = parseSorts(sortsIn);

      const filter = {};
      const conditions = [];

      for (const q of queries) {
        const [field, op, rawValue] = q;
        const value = coerceValue(rawValue);

        if (field === '$or' && op === 'custom' && Array.isArray(rawValue)) {
          const orConditions = rawValue.map(([subField, subOp, subValue]) => {
            const processedValue = coerceValue(subValue);
            switch (subOp) {
              case 'regex':
                return { [subField]: { $regex: processedValue, $options: 'i' } };
              case '==':
                return { [subField]: processedValue };
              case 'contains':
                return { [subField]: { $regex: processedValue, $options: 'i' } };
              default:
                return { [subField]: processedValue };
            }
          });
          conditions.push({ $or: orConditions });
          continue;
        }

        switch (op) {
          case '==':
            conditions.push({ [field]: value });
            break;
          case '!=':
            conditions.push({ [field]: { $ne: value } });
            break;
          case '>':
            conditions.push({ [field]: { $gt: value } });
            break;
          case '>=':
            conditions.push({ [field]: { $gte: value } });
            break;
          case '<':
            conditions.push({ [field]: { $lt: value } });
            break;
          case '<=':
            conditions.push({ [field]: { $lte: value } });
            break;
          case 'in':
            conditions.push({ [field]: { $in: Array.isArray(value) ? value : [value] } });
            break;
          case 'not-in':
            conditions.push({ [field]: { $nin: Array.isArray(value) ? value : [value] } });
            break;
          case 'regex':
          case 'contains':
            conditions.push({ [field]: { $regex: value, $options: 'i' } });
            break;
          case 'starts-with':
            conditions.push({ [field]: { $regex: `^${value}`, $options: 'i' } });
            break;
          case 'ends-with':
            conditions.push({ [field]: { $regex: `${value}$`, $options: 'i' } });
            break;
          case 'not-contains':
            conditions.push({ [field]: { $not: { $regex: value, $options: 'i' } } });
            break;
          case 'text':
            conditions.push({ $text: { $search: value } });
            break;
          case 'exists':
            conditions.push({ [field]: { $exists: Boolean(value) } });
            break;
          case 'not-exists':
            conditions.push({ [field]: { $exists: !Boolean(value) } });
            break;
          case 'array-contains':
            conditions.push({ [field]: { $elemMatch: { $eq: value } } });
            break;
          case 'array-contains-any':
            conditions.push({ [field]: { $in: Array.isArray(value) ? value : [value] } });
            break;
          default:
            throw new Error(`Unsupported operator: ${op}`);
        }
      }

      if (conditions.length > 0) {
        if (conditions.length === 1) Object.assign(filter, conditions[0]);
        else filter.$and = conditions;
      }

      const sortObj = {};
      for (const s of sorts) {
        const [field, dir] = s;
        sortObj[field] = dir || 'asc';
      }

      const page = Math.max(1, Number(currentPage) || 1);
      const size = Math.max(1, Number(perPage) || 15);
      const skip = (page - 1) * size;

      let query = model.find(filter);
      if (Object.keys(sortObj).length > 0) query = query.sort(sortObj);
      query = query.skip(skip).limit(size);

      const [data, count] = await Promise.all([query.exec(), model.countDocuments(filter)]);

      const totalPages = Math.max(1, Math.ceil(count / size));
      const nextPage = page < totalPages ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      return { data, count, pagination: { currentPage: page, perPage: size, totalPages, nextPage, prevPage } };
    } catch (err) {
      console.error('Error in PaginateHandler:', err);
      throw new Error('Failed to paginate data');
    }
  }

  // Get one document
  async getDocument(model, id) {
    const doc = await model.findById(id);
    if (!doc) throw new Error(`Document with ID ${id} not found`);
    return doc;
  }

  // Add new document
  async addDocument(model, body) {
    const now = new Date();
    const doc = new model({ id: body.id || uuidv4(), ...body, createdAt: now, updatedAt: now });
    await doc.save();
    return doc;
  }

  // Edit document
  async editDocument(model, id, body) {
    const doc = await model.findByIdAndUpdate(id, { ...body, updatedAt: new Date() }, { new: true });
    if (!doc) throw new Error(`Document with ID ${id} not found`);
    return doc;
  }

  // Delete document
  async deleteDocument(model, id) {
    const doc = await model.findByIdAndDelete(id);
    if (!doc) throw new Error(`Document with ID ${id} not found`);
    return { id, message: `Document with id: ${id} was deleted!` };
  }
}

module.exports = MongooseFeatures;