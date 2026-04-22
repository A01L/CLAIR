import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTIC_URL || 'http://localhost:9200',
});

export const APPEALS_INDEX = 'clair_appeals';

export async function initElastic() {
  try {
    const exists = await esClient.indices.exists({ index: APPEALS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: APPEALS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              cid: { type: 'integer' },
              rating: { type: 'integer' },
              emotion: { type: 'keyword' },
              type: { type: 'keyword' },
              status: { type: 'keyword' },
              text: { type: 'text', analyzer: 'standard' },
              ai_com: { type: 'text', analyzer: 'standard' },
              ai_solution: { type: 'text', analyzer: 'standard' },
              created_at: { type: 'date' }
            }
          }
        }
      });
      console.log(`✅ Elasticsearch index '${APPEALS_INDEX}' created.`);
    } else {
      console.log(`✅ Connected to Elasticsearch. Index '${APPEALS_INDEX}' exists.`);
    }
  } catch (err) {
    console.error('❌ Failed to initialize Elasticsearch:', err.message);
  }
}

export async function indexAppeal(appeal) {
  try {
    await esClient.index({
      index: APPEALS_INDEX,
      id: appeal.id.toString(),
      document: {
        id: appeal.id,
        cid: appeal.cid,
        rating: appeal.rating || appeal.emotion_rating,
        emotion: appeal.emotion,
        type: appeal.type || appeal.appeal_type,
        status: appeal.status,
        text: appeal.text, // Assuming text is available/normalized
        ai_com: appeal.ai_com || appeal.ai_comment,
        ai_solution: appeal.ai_solution,
        created_at: appeal.created_at || new Date()
      }
    });
  } catch (err) {
    console.error(`❌ Failed to index appeal ${appeal.id}:`, err.message);
  }
}

export async function searchAppeals(cid, queryText, filters = {}) {
  try {
    const must = [
      { term: { cid: cid } }
    ];

    if (queryText) {
      must.push({
        multi_match: {
          query: queryText,
          fields: ['text^3', 'ai_com', 'ai_solution'],
          fuzziness: 'AUTO'
        }
      });
    }

    if (filters.status) {
      must.push({ term: { status: filters.status } });
    }
    if (filters.type) {
      must.push({ term: { type: filters.type } });
    }

    const result = await esClient.search({
      index: APPEALS_INDEX,
      body: {
        query: {
          bool: {
            must
          }
        },
        sort: [
          { created_at: { order: 'desc' } }
        ],
        size: filters.size || 50
      }
    });

    return result.hits.hits.map(h => h._source);
  } catch (err) {
    console.error('Elasticsearch search error:', err.message);
    return [];
  }
}

export default esClient;

export async function deleteElasticAppeal(id) {
  try {
    await esClient.delete({
      index: APPEALS_INDEX,
      id: id.toString()
    });
  } catch (err) {
    if (err.meta?.statusCode !== 404) {
      console.error('❌ Failed to delete from elasticsearch:', err.message);
    }
  }
}

export async function deleteAllElasticAppealsByChannel(cid) {
  try {
    await esClient.deleteByQuery({
      index: APPEALS_INDEX,
      body: {
        query: {
          match: { cid: cid }
        }
      }
    });
  } catch (err) {
    console.error('❌ Failed to delete by channel from elasticsearch:', err.message);
  }
}
