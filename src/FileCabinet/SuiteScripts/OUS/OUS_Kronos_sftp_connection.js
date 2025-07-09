/*  This script make connection with sftp and download file in assigned folder of file cabinet /*


**
 * Copyright (c) 2024 Osmose, Inc.
 * All Rights Reserved.
 *
 * The following Javascript source code is intended for use on the Netsuite
 * platform.
 * This software is the confidential and proprietary information of
 * Osmose, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Osmose.
 *
 * Script Name: EmployeeTimeEntry_Rounding.js
 * Description: This User Event script automatically rounds the 'hours' field on 
 * the Employee Time Entry record during create or edit. It applies specific 
 * rounding rules to convert the decimal portion of hours into the nearest 
 * quarter-hour (0, 15, 30, 45, or round up to the next hour). In edit mode, the 
 * script only triggers if the 'hours' field has been modified. 
 *
 * Version History:
 *
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-04-16 | Himanshu Kumar   | Initial version                          |
 */

/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
 define(['N/sftp', 'N/runtime', 'N/file', 'N/log', 'N/search', 'N/record'],
    (sftp, runtime, file, log, search, record) => {

        const getInputData = () => {
            try {
                const username = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_user' });
                const passwordGuid = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_password' });
                const folderId = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_folder' });
                const remoteDir = runtime.getCurrentScript().getParameter({ name: 'custscript_sftp_dir' });

                const connection = sftp.createConnection({
                    username: username,
                    passwordGuid: passwordGuid,
                    url: 'osmoseutilities-uat-xfr.oss.mykronos.com',
                    port: 22,
                    directory: remoteDir,
                    hostKey: 'AAAAB3NzaC1yc2EAAAADAQABAAACAQCvBPnhWvaK7kFFajQXhv7mfoGA29oOWj3Bpuag7GWr7ZulQcfXmDDztsYoOAdAaKfnpsJQ7kkMczc3L5l3Uh5SGrz9pvpLINi9trRhj4sZBiV2tfPZCslQUNbmvi2m259IcVR+z7NT/3YZXoNYZ/KbX8XhUyaCHyA44BokTLewxHnq9SPwsQmwuy31LOW/74zbdEnRaa5qhOJCfYbFvMqiHNDa20weej7cYrf2u22XhLMEDjHKBLj0XMZGyySyB8B7xnMN5Zq3P+u1uuKbVO6s0KjgBOHr81hqMJHwli0z3pLaH+iMOoOkFNmndfFQGjifHBLqpcsXzaB4y3gTePyNGwxBOkok34JNLAvtfVNSdPkCYiUTurKBU8YZVzX8yDGs3uYPwv0rewL4nwY/XKtLIPFC0NBXTajrqp4ysfBeJKP2nGmNZIUWMwmwYin/augt9czQ4b9UIRrskGY+giie8NUA3fHl3XnliKSHQwKVOnBaJmLrqH9+0AlpafIOI710EvyJkGFR2lnA6t9it6tAlMmkZlfNmQU2af8Wsx3FRjAPqV82k4vniV0cb2L07oOoxYcN/L/hxy1q5ZbeXMSgzBiR2unulcekxSZo71j+kOoQ6CfNuWmV3cEhJJDTVp+aBUIgZFfi7vs5oEsB0miIW3rl8CfH8BvIJ4Xh6+xMgw==',
                    hostKeyType: 'rsa'
                });

                log.debug('SFTP Connected', connection);

                const files = connection.list({ directory: remoteDir });
                log.debug('files', files);
                const csvFiles = files.filter(f => f.name.endsWith('.csv.pgp'));

                const downloadedFiles = [];

                csvFiles.forEach(fileInfo => {
                    log.debug('filename', fileInfo.name);
                    const remoteFile = connection.download({
                        filename: fileInfo.name
                    });

                    const nsFile = file.create({
                        name: fileInfo.name,
                        fileType: file.Type.CSV,
                        contents: remoteFile.getContents(),
                        folder: folderId,
                        isOnline: false
                    });

                    const fileId = nsFile.save();
                    log.audit('File Saved', `${fileInfo.name} → ID ${fileId}`);
                    downloadedFiles.push(fileInfo.name);
                });

                return downloadedFiles;

            } catch (e) {
                log.error('SFTP Connection or Download Error', e);
                throw e;
            }
        };

        const map = (context) => {
            log.debug('Downloaded File', context.value);
        };

        const summarize = (summary) => {
            log.audit('SFTP File Download Complete', 'Files downloaded and stored.');
        };

        return {
            getInputData,
            map,
            summarize
        };
    });
