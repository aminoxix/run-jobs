const { readFile, writeFile } = require('fs/promises');
const yaml = require('js-yaml');
const {
    loadJson,
    loadYaml,
    hasRelevantFlag,
    mergeUniqueMembers,
    generateTSCBoardMembersList
} = require('../src/main');

jest.mock('js-yaml');
jest.mock('fs/promises');

describe('generateTSCBoardMembersList', () => {
    const maintainers = [
        { github: 'alice', isTscMember: true },
        { github: 'bob', isBoardChair: true },
        { github: 'charlie' } // no flag
    ];

    const ambassadors = [
        { github: 'bob', isBoardMember: true }, // overlap
        { github: 'dave', isBoardMember: true },
        { github: 'eve' } // no flag
    ];

    const mergedExpected = [
        { github: 'alice', isTscMember: true },
        { github: 'bob', isBoardChair: true, isBoardMember: true },
        { github: 'dave', isBoardMember: true }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loadYaml should parse YAML content', async () => {
        readFile.mockResolvedValueOnce('yaml-content');
        yaml.load.mockReturnValueOnce([{ github: 'test', isTscMember: true }]);

        const result = await loadYaml('path/to/file.yaml');
        expect(result).toEqual([{ github: 'test', isTscMember: true }]);
        expect(readFile).toHaveBeenCalledWith('path/to/file.yaml', 'utf-8');
        expect(yaml.load).toHaveBeenCalledWith('yaml-content');
    });

    it('loadJson should parse JSON content', async () => {
        const json = JSON.stringify([{ github: 'test', isTscMember: true }]);
        readFile.mockResolvedValueOnce(json);

        const result = await loadJson('path/to/file.json');
        expect(result).toEqual([{ github: 'test', isTscMember: true }]);
        expect(readFile).toHaveBeenCalledWith('path/to/file.json', 'utf-8');
    });

    it('hasRelevantFlag should return true for members with flags', () => {
        expect(hasRelevantFlag({ isTscMember: true })).toBe(true);
        expect(hasRelevantFlag({ isBoardMember: true })).toBe(true);
        expect(hasRelevantFlag({ isBoardChair: true })).toBe(true);
        expect(hasRelevantFlag({})).toBe(false);
    });

    it('mergeUniqueMembers should merge and deduplicate members correctly', () => {
        const result = mergeUniqueMembers(maintainers, ambassadors);
        expect(result).toEqual(mergedExpected);
    });

    it('generateTSCBoardMembersList should write filtered list', async () => {
        readFile.mockImplementation((filePath) => {
            if (filePath.includes('MAINTAINERS.yaml')) {
                return Promise.resolve('maintainers-yaml-content');
            }
            if (filePath.includes('AMBASSADORS_MEMBERS.json')) {
                return Promise.resolve(JSON.stringify(ambassadors));
            }
            return Promise.resolve('[]');
        });

        yaml.load.mockReturnValue(maintainers);
        yaml.dump.mockReturnValue('yaml-content');

        const logSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
        await generateTSCBoardMembersList();

        expect(readFile).toHaveBeenCalledWith(expect.stringContaining('MAINTAINERS.yaml'), 'utf-8');
        expect(readFile).toHaveBeenCalledWith(expect.stringContaining('AMBASSADORS_MEMBERS.json'), 'utf-8');
        expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('TSC_BOARD_MEMBERS.yaml'), 'yaml-content', 'utf-8');
        expect(logSpy).toHaveBeenCalledWith('✅ Generated 3 filtered TSC/Board members');
    });

    it('generateTSCBoardMembersList should handle errors and log them', async () => {
        readFile.mockRejectedValueOnce(new Error('YAML read failure'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        try {
            await generateTSCBoardMembersList();
        } catch (e) { }

        expect(errorSpy).toHaveBeenCalledWith(
            '❌ Failed to generate TSC members list:',
            expect.any(Error)
        );
    });
});
