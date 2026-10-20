import { Endpoints } from '../../../common/constants/index.js';
import { useFetch } from '../../../common/helpers/index.js';
import { CreateSongStationUseCase, GetSongByIdUseCase, GetSongByLinkUseCase, GetSongSuggestionsUseCase } from '../use-cases/index.js';
import { HTTPException } from 'hono/http-exception';
export class SongService {
    getSongByIdUseCase;
    getSongByLinkUseCase;
    createSongStationUseCase;
    getSongSuggestionsUseCase;
    constructor() {
        this.getSongByIdUseCase = new GetSongByIdUseCase();
        this.getSongByLinkUseCase = new GetSongByLinkUseCase();
        this.createSongStationUseCase = new CreateSongStationUseCase();
        this.getSongSuggestionsUseCase = new GetSongSuggestionsUseCase();
    }
    getSongByIds = (args) => {
        return this.getSongByIdUseCase.execute(args);
    };
    getSongByLink = (token) => {
        return this.getSongByLinkUseCase.execute(token);
    };
    createSongStation = (songIds) => {
        return this.createSongStationUseCase.execute(songIds);
    };
    getSongSuggestions = (args) => {
        return this.getSongSuggestionsUseCase.execute(args);
    };
    getLyricsBySongId = async (songId) => {
        const [song] = await this.getSongByIds({ songIds: songId });
        if (!song?.hasLyrics)
            return null;
        const { data, ok } = await useFetch({
            endpoint: Endpoints.songs.lyrics,
            params: { lyrics_id: song.lyricsId || song.id }
        });
        if (!ok)
            throw new HTTPException(502, { message: 'Unable to retrieve song lyrics' });
        return data;
    };
}
