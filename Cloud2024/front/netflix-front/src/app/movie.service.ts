import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  constructor(private http: HttpClient) {}

  getMovie(id: string): Observable<any> {
    const params = new HttpParams().set('id', id);
    return this.http.get<any>(environment.apiUrl + 'movies/downloadMetadata', {
      params,
    });
  }

  downloadMovie(id: string): Observable<any> {
    const params = new HttpParams().set('id', id);
    return this.http.get(environment.apiUrl + `movies/downloadMovie`, {
      params: params,
      responseType: 'text' as 'json',
    });
  }

  getTvShow(title: string): Observable<any> {
    const params = new HttpParams().set('title', title);
    return this.http.get<any>(
      environment.apiUrl + 'movies/downloadMetadataTvShow',
      { params }
    );
  }

  checkEpisode(title: string, episode: string, season: string) {
    const params = new HttpParams()
      .set('title', title)
      .set('episodeNumber', episode)
      .set('seasonNumber', season);
    return this.http.get<any>(environment.apiUrl + 'movies/checkEpisode', {
      params,
    });
  }

  checkMovie(title: string) {
    const params = new HttpParams().set('title', title);
    return this.http.get<any>(environment.apiUrl + 'movies/checkIfMovie', {
      params,
    });
  }

  uploadMetadata(metadata: any): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    return this.http.post<any>(
      environment.apiUrl + 'movies/metadata',
      metadata, { headers }
    );
  }

  uploadVideo(video: any): Observable<any> {
    return this.http.post<any>(
      environment.apiUrl + 'transcoding/transcode',
      video
    );
  }

  updateMetadata(metadata: any): Observable<any> {
    return this.http.put<any>(environment.apiUrl + 'movies/metadata', metadata);
  }

  updateVideo(video: any): Observable<any> {
    return this.http.put<any>(environment.apiUrl + 'movies/video', video);
  }

  deleteMetadata(id: string): Observable<any> {
    const params = new HttpParams().set('id', id);
    return this.http.delete<any>(environment.apiUrl + 'movies/metadata', {
      params,
    });
  }

  deleteVideo(id: string): Observable<any> {
    const params = new HttpParams().set('id', id);
    return this.http.delete<any>(environment.apiUrl + 'movies/video', {
      params,
    });
  }

  rateMovie(
    ratingId: string,
    movieId: string,
    rating: string,
    username: string
  ): Observable<any> {
    const body = { ratingId, movieId, rating, username };
    console.log(body);
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    return this.http.post<any>(environment.apiUrl + 'movies/rate', body, {
      headers,
    });
  }

  getMovieRating(movieId: string, username: string) {
    const params = new HttpParams()
      .set('movieId', movieId)
      .set('username', username);
    return this.http.get<string>(environment.apiUrl + 'movies/rating', {
      params,
    });
  }

  getSubscriptions(id: string): Observable<any> {
    const params = new HttpParams().set('id', id);
    return this.http.get<any>(environment.apiUrl + 'subscribe', {
      params,
    });
  }

  subscribe(data: any): Observable<any> {
    const username = localStorage.getItem('user');
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    const body = {
      username: username,
      data: data,
    };
    console.log(body);
    return this.http.post<any>(environment.apiUrl + 'subscribe', body, { headers });
  }

  searchMovies(metadata: any): Observable<any> {
    return this.http.post<any>(environment.apiUrl + 'movies/search', metadata);
  }
}
