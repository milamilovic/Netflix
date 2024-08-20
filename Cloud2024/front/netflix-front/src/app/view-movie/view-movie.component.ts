import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../movie.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {UserService} from "../user.service";
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-view-movie',
  templateUrl: './view-movie.component.html',
  styleUrls: ['./view-movie.component.css']
})
export class ViewMovieComponent implements OnInit{
  movie: any;
  thumbnailImageSrc: string = "";
  videoSrc: string = "";
  rating: string = "";
  selectedQuality: string = "";
  @ViewChild('videoPlayer') videoPlayer!: ElementRef;
  isAdmin: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private movieService: MovieService,
    private http: HttpClient,
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
    const id = this.route.snapshot.paramMap.get('id');
    const username = localStorage.getItem('user');
    console.log("id is " + id)
    if (id && username) {
      this.movieService.getMovie(id).subscribe((data) => {
        if(data.isMovie) {
          this.movie = data;
          const base64Thumbnail = "data:image/png;base64," + this.movie.thumbnailImage;
          this.thumbnailImageSrc = base64Thumbnail;
          this.selectedQuality = this.movie.qualities[0]; // Set default quality
          console.log("Qualities: ")
          for(let quality in this.movie.qualities) {
            console.log(quality)
          }
          this.movieService.getMovieRating(id, username).subscribe({
            next: (response : any) => {
              console.log('user rating: ', response);
              this.rating = response.rating;
            },
            error: (err: any) => {
              console.error('Error fetching rating: ', err)
            }
          });
        } else {
          alert("The movie you're trying to access is a tv show!")
        }
      });
    }
  }

  playMovie(): void {
    if (this.selectedQuality) {
      const id = this.route.snapshot.paramMap.get('id') + "_" + this.selectedQuality;
      console.log("playing again...")
      this.http.get(environment.apiUrl + `movies/downloadMovie?id=${id}`, { responseType: 'text' }).subscribe((response: any) => {
        this.videoSrc = `data:video/mp4;base64,${response}`;
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

  rateMovie(rating: string): void {
    const movieId = this.route.snapshot.paramMap.get('id');
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

  downloadMovie(): void {
    if (this.selectedQuality) {
      const id = this.route.snapshot.paramMap.get('id') + "_" + this.selectedQuality;
      console.log("downloading movie...")
      this.http.get(environment.apiUrl + `movies/downloadMovie?id=${id}`, { responseType: 'text' }).subscribe((response: any) => {
        const videoSrc = `data:video/mp4;base64,${response}`;
        const link = document.createElement('a');
        link.href = videoSrc;
        link.download = this.movie.title + '.mp4';
        link.click();
      }, error => {
        console.error('Error fetching video:', error);
      });
      const movieId = this.route.snapshot.paramMap.get('id');
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
    this.playMovie();
  }
}
