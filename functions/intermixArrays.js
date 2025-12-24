//Evenly intermix two arrays, maintaining relative order within each array
export function IntermixArrays(arr1, arr2) {
    if (!arr1.length) return arr2;
    if (!arr2.length) return arr1;
    
    const result = [];
    const [larger, smaller] = arr1.length >= arr2.length ? [arr1, arr2] : [arr2, arr1];
    const ratio = larger.length / (smaller.length + 1);
    
    let smallerIndex = 0;
    let nextInsert = ratio;
    
    for (let i = 0; i < larger.length; i++) {
        while (smallerIndex < smaller.length && i >= nextInsert) {
            result.push(smaller[smallerIndex++]);
            nextInsert += ratio;
        }
        result.push(larger[i]);
    }
    
    while (smallerIndex < smaller.length) {
        result.push(smaller[smallerIndex++]);
    }
    
    return result;
}