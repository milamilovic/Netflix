import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../movie.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {UserService} from "../user.service";
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-view-show',
  templateUrl: './view-show.component.html',
  styleUrls: ['./view-show.component.css']
})
export class ViewShowComponent implements OnInit {
  tvShow: any = {
    "thumbnailImage": "",
    "actors": [],
    "directors": [],
    "genres": [],
    "title": ""
  };
  episodes: any[] = [];
  qualities: any[] = [];
  thumbnailImageSrc: string = "";
  videoSrc: string = "";
  rating: string = "";
  selectedQuality: string = "";
  @ViewChild('videoPlayer') videoPlayer!: ElementRef;
  isAdmin: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private movieService: MovieService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem("idToken")
    if (token == null) {
      this.router.navigate(['/']);
      return;
    }
    const helper = new JwtHelperService();
    const decodedToken = helper.decodeToken(token);
    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"
    const title = this.route.snapshot.paramMap.get('title');
    this.tvShow.title = title?.replace("-", " ");
    const username = localStorage.getItem('user');
    console.log("title is " + title);
    if (title && username) {
      this.movieService.getTvShow(title).subscribe((data: any) => {
        if(data[0].isMovie) {
            alert("This title is a movie!")
        } else {
          this.episodes = data;
          // Sort episodes by seasonNumber and episodeNumber
          this.episodes.sort((a: any, b: any) => {
            if (a.seasonNumber === b.seasonNumber) {
              return a.episodeNumber - b.episodeNumber;
            } else {
              return a.seasonNumber - b.seasonNumber;
            }
          });
          let actorsSet = new Set();
          let directorsSet = new Set();
          let genresSet = new Set();
          let qualitiesSet = new Set();
          this.episodes.forEach(episode => {
            episode.actors.forEach((actor : any) => {
              actorsSet.add(actor);
            });
            episode.directors.forEach((director : any) => {
              directorsSet.add(director);
            });
            episode.genres.forEach((genre : any) => {
              genresSet.add(genre);
            });
            this.tvShow.actors = Array.from(actorsSet);
            this.tvShow.directors = Array.from(directorsSet);
            this.tvShow.genres = Array.from(genresSet);
            if (episode.description) {
              this.tvShow.description = episode.description;
            }
            if (episode.thumbnailImage) {
              this.thumbnailImageSrc = "data:image/png;base64," + episode.thumbnailImage;
            }
            this.movieService.getMovieRating(episode.id, username).subscribe({
              next: (response : any) => {
                console.log('user rating: ', response);
                this.rating = response.rating;
              },
              error: (err: any) => {
                console.error('Error fetching rating: ', err)
              }
            });
            if (episode.qualities) {
              episode.qualities.forEach((quality : any) => {
                qualitiesSet.add(quality);
              });
            }
            this.selectedQuality = episode.qualities[0]; // Set default quality
          });
          this.qualities = Array.from(qualitiesSet);
        }
      });
    }
  }

  playEpisode(episode: any): void {
    if (this.selectedQuality) {
      if (!episode.qualities.includes(this.selectedQuality)) {
        alert(`Quality ${this.selectedQuality} is not available for this episode.`);
        return;
      }
      const id = episode.id + "_" + this.selectedQuality;
      console.log("playing again...")
      this.videoSrc = "";
      this.cdr.detectChanges();   //detect that another video is clicked

      this.http.get(environment.apiUrl + `movies/downloadMovie?id=${id}`, { responseType: 'text' }).subscribe((response: any) => {
        this.videoSrc = `data:video/mp4;base64,${response}`;
        // Detect changes and ensure the videoPlayer is available
        this.cdr.detectChanges();
        if (this.videoPlayer && this.videoPlayer.nativeElement) {
          this.videoPlayer.nativeElement.play();
        } else {
          console.error('Video player element is not available');
        }
      }, error => {
        console.error('Error fetching video:', error);
      });
    }
  }

  generateId(): number {
    return Math.floor(Math.random() * 1000000)
  }

  rateMovie(rating: string, episode: any): void {
    const movieId = episode.id;
    const username = localStorage.getItem('user');
    const ratingId = this.generateId().toString();
    if (movieId && username) {
      this.movieService.rateMovie(ratingId, movieId, rating, username).subscribe({
        next: (response : any) => {
          console.log('Rating successful: ', response);
          alert(response.message);
          this.movieService.getMovieRating(movieId, username).subscribe({
            next: (response : any) => {
              console.log('user rating: ', response);
              this.rating = response.rating;
            },
            error: (err: any) => {
              console.error('Error fetching rating: ', err)
            }
          });
          this.userService.generateFeed(username).subscribe({
            next: (response : any) => {
              console.log('generating feed...');
            },
            error: (err: any) => {
              console.error('Error generating feed: ', err)
            }
          });
        },
        error: (err: any) => {
          console.error('Rating failed: ', err)
        }
      });
    }
  }

  downloadEpisode(episode: any): void {
    if (this.selectedQuality) {
      if (!episode.qualities.includes(this.selectedQuality)) {
        alert(`Quality ${this.selectedQuality} is not available for this episode.`);
        return;
      }
      const id = episode.id + "_" + this.selectedQuality;
      console.log("downloading episode...")
      this.http.get(environment.apiUrl + `movies/downloadMovie?id=${id}`, { responseType: 'text' }).subscribe((response: any) => {
        const videoSrc = `data:video/mp4;base64,${response}`;
        const link = document.createElement('a');
        link.href = videoSrc;
        link.download = episode.episodeTitle + '.mp4';
        link.click();
      }, error => {
        console.error('Error fetching video:', error);
      });
      const movieId = episode.id;
      const username = localStorage.getItem('user');
      const downloadId = this.generateId().toString();
      console.log(downloadId)
      if (movieId && username ){
        this.userService.addMovieToDownloadHistory(username, movieId, downloadId).subscribe({
          next: (response : any) => {
            console.log(response.message);
          },
          error: (err: any) => {
            console.error('Error: ', err)
          }
        });
        this.userService.generateFeed(username).subscribe({
          next: (response : any) => {
            console.log('generating feed...');
          },
          error: (err: any) => {
            console.error('Error generating feed: ', err)
          }
        });
      }
    }
  }

  onQualityChange(quality: string): void {
    this.videoSrc = ""
    this.selectedQuality = quality;
  }
}
