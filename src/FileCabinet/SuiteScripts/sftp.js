/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

 define(['N/sftp', 'N/runtime', 'N/file', 'N/log', 'N/search', 'N/record'],
    function(sftp, runtime, file, log, search, record) {
    
        function getOrCreateFolder(folderName) {
            var folderSearch = search.create({
                type: search.Type.FOLDER,
                filters: [['name', 'is', folderName]],
                columns: ['internalid']
            });
    
            var searchResult = folderSearch.run().getRange({ start: 0, end: 1 });
            if (searchResult.length > 0) {
                return searchResult[0].getValue('internalid');
            }
    
            // Folder doesn't exist, create it
            var newFolder = record.create({ type: record.Type.FOLDER });
            newFolder.setValue({ fieldId: 'name', value: folderName });
            return newFolder.save();
        }
    
        function getInputData() {
            try {
                var username = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_user' });
                var passwordGuid = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_password' });
    
                var connection = sftp.createConnection({
                    username: username,
                    passwordGuid: passwordGuid,
                    url: 'osmoseutilities-uat-xfr.oss.mykronos.com',
                    port: 22,
                    directory: '/Outbound',
                    hostKey: 'AAAAB3NzaC1yc2EAAAADAQABAAACAQCvBPnhWvaK7kFFajQXhv7mfoGA29oOWj3Bpuag7GWr7ZulQcfXmDDztsYoOAdAaKfnpsJQ7kkMczc3L5l3Uh5SGrz9pvpLINi9trRhj4sZBiV2tfPZCslQUNbmvi2m259IcVR+z7NT/3YZXoNYZ/KbX8XhUyaCHyA44BokTLewxHnq9SPwsQmwuy31LOW/74zbdEnRaa5qhOJCfYbFvMqiHNDa20weej7cYrf2u22XhLMEDjHKBLj0XMZGyySyB8B7xnMN5Zq3P+u1uuKbVO6s0KjgBOHr81hqMJHwli0z3pLaH+iMOoOkFNmndfFQGjifHBLqpcsXzaB4y3gTePyNGwxBOkok34JNLAvtfVNSdPkCYiUTurKBU8YZVzX8yDGs3uYPwv0rewL4nwY/XKtLIPFC0NBXTajrqp4ysfBeJKP2nGmNZIUWMwmwYin/augt9czQ4b9UIRrskGY+giie8NUA3fHl3XnliKSHQwKVOnBaJmLrqH9+0AlpafIOI710EvyJkGFR2lnA6t9it6tAlMmkZlfNmQU2af8Wsx3FRjAPqV82k4vniV0cb2L07oOoxYcN/L/hxy1q5ZbeXMSgzBiR2unulcekxSZo71j+kOoQ6CfNuWmV3cEhJJDTVp+aBUIgZFfi7vs5oEsB0miIW3rl8CfH8BvIJ4Xh6+xMgw==',
                    hostKeyType: 'rsa'
                    //hostKey: 'AAAAB3NzaC1yc2EAAAADAQABAAACAQCvBPnhWvaK7kFFajQXhv7mfoGA29oOWj3Bpuag7GWr7ZulQcfXmDDztsYoOAdAaKfnpsJQ7kkMczc3L5l3Uh5SGrz9pvpLINi9trRhj4sZBiV2tfPZCslQUNbmvi2m259IcVR' // <-- Add actual host key here when available
                });
    
                log.debug('SFTP Connected', true);
    
                var files = connection.list({ directory: '/Outbound' });
                var csvFiles = files.filter(function(f) {
                    return f.name && f.name.toLowerCase().endsWith('.csv');
                });
    
                var folderId = getOrCreateFolder('SFTP Data extract');
    
                var downloaded = [];
    
                for (var i = 0; i < csvFiles.length; i++) {
                    var fileInfo = csvFiles[i];
                    var downloadedFile = connection.download({
                        directory: '/Outbound',
                        filename: fileInfo.name
                    });
    
                    var nsFile = file.create({
                        name: fileInfo.name,
                        fileType: file.Type.CSV,
                        contents: downloadedFile.getContents(),
                        folder: folderId,
                        isOnline: false
                    });
    
                    var savedFileId = nsFile.save();
                    log.audit('File Saved', fileInfo.name + ' → ID ' + savedFileId);
                    downloaded.push(fileInfo.name);
                }
    
                return downloaded;
    
            } catch (e) {
                log.error('SFTP Connection or Download Error', e);
                throw e;
            }
        }
    
        function map(context) {
            log.debug('Downloaded File', context.value);
        }
    
        function reduce(context) {
            // Not used in this case
        }
    
        function summarize(summary) {
            log.audit('SFTP File Download Complete', 'Downloaded files processed.');
        }
    
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
    