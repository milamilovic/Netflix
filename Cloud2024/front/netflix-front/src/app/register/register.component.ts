import { Component, OnInit } from '@angular/core';
import { UserService } from '../user.service';
import {Router} from "@angular/router";

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent implements OnInit {
  username: string = '';
  password: string = '';
  password2: string = '';
  name: string = '';
  surname: string = '';
  email: string = '';
  birthday: Date = new Date();

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {}

  usernameExists(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.userService.checkUsername(this.username).subscribe({
        next: (response: any) => {
          console.log(response);
          var exists: boolean = response.exists;
          console.log(exists);
          if (exists) {
            console.log('dunja');
            resolve(true);
          } else {
            console.log('dobro');
            resolve(false);
          }
        },
        error: (err) => {
          console.error('Username checking failed: ', err);
          reject(err);
        },
      });
    });
  }

  async canRegister(): Promise<boolean> {
    if (
      this.username &&
      this.password &&
      this.password2 &&
      this.name &&
      this.surname &&
      this.email &&
      this.birthday
    ) {
      const usernameExists = await this.usernameExists();
      await this.generateFeed();
      console.log(!usernameExists)
      if (!usernameExists) {
        const today = new Date();
        console.log(today);
        //if (this.birthday < today) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailRegex.test(this.email)) {
          if (this.password === this.password2) {
            const passwordRegex =
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[*!?\-./()']).{8,}$/;
            if (passwordRegex.test(this.password)) {
              console.log('sve ok');
              return true;
            } else {
              console.log('losa lozinka');
              alert(
                "Password must contain at least 8 characters, \none lowercase letter, one uppercase letter, \none number, and one special character (* ! ? - . / ( ) ')."
              );
            }
          } else {
            console.log('lozinke nisu iste');
            alert('Passwords do not match.');
          }
        } else {
          console.log('los email');
          alert('Email address is not valid.');
        }
        /*} else {
          console.log("posle danas rodj")
          alert("Birthday have to be before today's date.");
        }*/
      } else {
        console.log('zauzeto kor ime');
        alert('Username already exists.');
      }
    } else {
      console.log('nije sve popunjeno');
      alert('All fields are required.');
    }
    return false;
  }

  async generateFeed() : Promise<void> {
    this.userService.generateFeed(this.username).subscribe({
      next: (response: any) => {
        console.log('generating feed...');
      },
      error: (err: any) => {
        console.error('Error generating feed: ', err)
      }
    });
  }

  async onRegister() {
    if (await this.canRegister()) {
      this.userService
        .register(
          this.username,
          this.password,
          this.name,
          this.surname,
          this.email,
          this.birthday
        )
        .subscribe({
          next: (response: any) => {
            console.log('Register successful');
            // login after register
            this.userService.login(this.username, this.password).subscribe({
              next: (response2: any) => {
                localStorage.setItem('accessToken', response2.accessToken);
                localStorage.setItem('user', this.username);
                localStorage.setItem('idToken', response2.idToken);
                console.log('Login successful');
                this.router.navigate(['/home']);
              },
              error: (err) => {
                console.error('Login failed: ', err);
                alert(err.error.error);
              },
            });
          },
          error: (err) => {
            console.error('Register failed: ', err);
            //alert(err.error.error);
          },
        });
    }
  }
}
