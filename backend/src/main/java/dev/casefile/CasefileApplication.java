package dev.casefile;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CasefileApplication {
    public static void main(String[] args) { SpringApplication.run(CasefileApplication.class, args); }
}
