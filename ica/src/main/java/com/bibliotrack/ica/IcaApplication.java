	package com.bibliotrack.ica;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class IcaApplication {

	public static void main(String[] args) {
		SpringApplication.run(IcaApplication.class, args);
	}

}
//ssh -p 443 -R 0:localhost:8081 -o ServerAliveInterval=30 qr@a.pinggy.io
