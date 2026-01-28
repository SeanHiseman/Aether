//Pre-normalize embeddings ONCE when loading algorithm
export function prepareAlgorithmEmbeddings(algorithmRow) {
    const result = {
        normalizedBoost: [],
        normalizedSuppress: []
    };
    if (algorithmRow?.boost_embedding) {
        let boostVecs = algorithmRow.boost_embedding;
        if (typeof boostVecs === 'string') {
            try { boostVecs = JSON.parse(boostVecs); } catch { boostVecs = []; }
        }
        if (Array.isArray(boostVecs)) {
            result.normalizedBoost = boostVecs
                .filter(bv => Array.isArray(bv) && bv.length > 0)
                .map(bv => {
                    const m = Math.sqrt(bv.reduce((a, b) => a + b * b, 0)) || 1;
                    return bv.map(v => v / m);
                });
        }
    }
    if (algorithmRow?.suppress_embedding) {
        let suppressVecs = algorithmRow.suppress_embedding;
        if (typeof suppressVecs === 'string') {
            try { suppressVecs = JSON.parse(suppressVecs); } catch { suppressVecs = []; }
        }
        if (Array.isArray(suppressVecs)) {
            result.normalizedSuppress = suppressVecs
                .filter(sv => Array.isArray(sv) && sv.length > 0)
                .map(sv => {
                    const m = Math.sqrt(sv.reduce((a, b) => a + b * b, 0)) || 1;
                    return sv.map(v => v / m);
                });
        }
    }
    return result;
}