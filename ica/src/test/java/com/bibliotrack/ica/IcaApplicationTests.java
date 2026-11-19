package com.bibliotrack.ica;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "bibliotrack.security.migrate-legacy-passwords=false")
class IcaApplicationTests {

	@Test
	void contextLoads() {
	}

}
