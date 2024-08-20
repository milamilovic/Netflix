import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });
    const body = {
      'username': username,
      'password': password
    };
    return this.http.post<any>(environment.apiUrl + "login", body, { headers });
  }

  register(username: string, password: string, name: string, surname: string,
           email: string, birthday: Date): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });
    const body = {
      'username': username,
      'password': password,
      'name': name,
      'surname': surname,
      'email': email,
      'birthday': birthday,
    };
    return this.http.post<any>(environment.apiUrl + "register", body, { headers });
  }

  checkUsername(username : string) {
    const params = new HttpParams().set('username', username);
    return this.http.get<boolean>(environment.apiUrl + "register/checkUsername", { params })
  }

  generateFeed(username: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });
    const body = {
      'username': username
    };
    return this.http.post<any>(environment.apiUrl + "generateFeed", body, { headers });
  }

  generateFeedForAll(): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });
    const body = { helper: 'heeeelp' };
    return this.http.post<any>(environment.apiUrl + "generateFeedForAll", body, { headers });
  }

  loadFeed(username: string) {
    const params = new HttpParams()
      .set('username', username);
    return this.http.get<any>(environment.apiUrl + "home", { params });
  }

  addMovieToDownloadHistory(username: string, movieId: string, downloadId: string){
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });
    const body = {
      'username': username,
      'movieId': movieId,
      'downloadId': downloadId
    }
    console.log(body)
    return this.http.post<any>(environment.apiUrl + "movies/downloadHistory", body, { headers });
  }
}
