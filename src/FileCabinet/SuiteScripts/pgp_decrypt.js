/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/file', 'N/crypto', 'N/search', 'N/log'], (file, crypto, search, log) => {
  
    const PGP_FILE_ID = 4153677;
    const TARGET_FOLDER_ID = 2562458;
  
    function getPGPCredentials() {
      const credentialsSearch = search.create({
        type: 'customrecord_pgp_credentials',
        filters: [],
        columns: [
          'custrecord_private_key_file_id',
          'custrecord_pgp_passphrase'
        ]
      });
  
      const result = credentialsSearch.run().getRange({ start: 0, end: 1 })[0];
  
      if (!result) throw new Error('No PGP credentials found in custom record.');
  
      return {
        privateKeyFileId: result.getValue('custrecord_private_key_file_id'),
        passphrase: result.getValue('custrecord_pgp_passphrase')
      };
    }
  
    function onRequest(context) {
      try {
        const { privateKeyFileId, passphrase } = getPGPCredentials();
  
        const pgpFile = file.load({ id: PGP_FILE_ID });
        const pgpContent = pgpFile.getContents();
  
        const privateKeyFile = file.load({ id: privateKeyFileId });
        const privateKey = privateKeyFile.getContents();
  
        const key = crypto.createSecretKey({
          guid: crypto.Guid.generate(),
          password: passphrase,
          key: privateKey
        });
  
        const decryptedContent = crypto.decrypt({
          algorithm: crypto.EncryptionAlg.PGP,
          key: key,
          input: pgpContent,
          inputEncoding: crypto.Encoding.BASE_64,
          outputEncoding: crypto.Encoding.UTF_8
        });
  
        const newCsvFile = file.create({
          name: 'sabinet_decrypted.csv',
          fileType: file.Type.CSV,
          contents: decryptedContent,
          folder: TARGET_FOLDER_ID
        });
  
        const newFileId = newCsvFile.save();
        context.response.write(`✅ Decryption successful. File saved with ID: ${newFileId}`);
      } catch (e) {
        log.error('Decryption Error', e);
        context.response.write(`❌ Error: ${e.message}`);
      }
    }
  
    return { onRequest };
  });
  